import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  brief: z.object({
    platform: z.enum(["YouTube Shorts", "Instagram Reels", "TikTok"]),
    topic: z.string().min(1).max(120),
    audience: z.string().min(1).max(200),
    goal: z.enum(["Educate", "Entertain", "Encourage saves", "Encourage follows"]),
  }),
  frames: z.array(z.object({
    id: z.string().regex(/^f\d+$/),
    time: z.number().min(0).max(90),
    image: z.string().regex(/^data:image\/jpeg;base64,/).max(300_000),
  })).min(1).max(12),
});

const findingSchema = z.object({
  frameId: z.string(),
  kind: z.enum(["strength", "improvement"]),
  title: z.string().min(1).max(90),
  observation: z.string().min(1).max(400),
  whyItMatters: z.string().min(1).max(400),
  suggestion: z.string().min(1).max(400),
});
const reviewSchema = z.object({ summary: z.string().min(1).max(700), findings: z.array(findingSchema).max(6) });

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI review is not configured. Add OPENAI_API_KEY on the server." }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  const { frames, brief } = parsed.data;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 1100,
      input: [{ role: "user", content: [
        { type: "input_text", text: `Review this short video from sampled still frames only. Topic: ${brief.topic}. Audience: ${brief.audience}. Goal: ${brief.goal}. Platform: ${brief.platform}. Each frame has an application ID and timestamp. Give a concise summary and up to 4 evidence-grounded findings. Every finding must cite one supplied frame ID. Separate observation, audience relevance and actionable suggestion. Do not infer speech, audio, precise motion, retention, or outcomes. Frames: ${frames.map(f => `${f.id}=${f.time.toFixed(1)}s`).join(", ")}. Return JSON with summary and findings; each finding has frameId, kind (strength or improvement), title, observation, whyItMatters, suggestion.` },
        ...frames.map(frame => ({ type: "input_image" as const, image_url: frame.image, detail: "low" as const })),
      ] }],
      text: { format: { type: "json_object" } },
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ error: "The AI review could not be completed. Please try again." }, { status: 502 });
  const data = await response.json();
  const output = (data.output || []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
    .filter((item: { type: string }) => item.type === "output_text").map((item: { text: string }) => item.text).join("");
  let result: unknown;
  try { result = JSON.parse(output); } catch { return NextResponse.json({ error: "The AI returned an unreadable review." }, { status: 502 }); }
  const review = reviewSchema.safeParse(result);
  if (!review.success || review.data.findings.some(f => !frames.some(frame => frame.id === f.frameId))) {
    return NextResponse.json({ error: "The AI review did not match the supplied evidence." }, { status: 502 });
  }
  return NextResponse.json(review.data, { headers: { "Cache-Control": "no-store" } });
}

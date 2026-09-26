import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./openai";
import { EvidenceValidationError } from "../analysis/evidence";

export async function boundedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError("Evidence request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Missing request body.", 400);
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new ApiError("Evidence request is too large.", 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}
export async function readJson<T extends z.ZodType>(request: Request, schema: T, maxBytes: number): Promise<z.infer<T>> {
  const bytes = await boundedBody(request, maxBytes);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError("Invalid JSON request.", 400); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError("Invalid analysis evidence.", 400);
  return parsed.data;
}
export function json(value: unknown) { return NextResponse.json(value, { headers: { "Cache-Control": "no-store" } }); }
export function failure(error: unknown, stage = "analysis") {
  const e = error instanceof ApiError ? error : error instanceof EvidenceValidationError
    ? new ApiError(error.message)
    : new ApiError("An unexpected server error prevented this stage from completing.", 500);
  return NextResponse.json({ error: `${stage}: ${e.message}`, stage, retryable: e.retryable, retryAfterMs: e.retryAfterMs }, { status: e.status, headers: { "Cache-Control": "no-store" } });
}

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanRecord } from "../types";

// The started plan lives in an httpOnly cookie, HMAC-signed with the Auth.js secret so
// the browser can't edit the baseline or start date. Browser-only storage by design (the
// hackathon choice): it doesn't follow the creator to another device.

export const PLAN_COOKIE_MAX_AGE = 60 * 60 * 24 * 120; // 120 days — longer than a 12-week plan

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is not configured.");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodePlan(record: PlanRecord): string {
  const payload = Buffer.from(JSON.stringify(record)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodePlan(value: string | undefined): PlanRecord | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const record = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlanRecord;
    return record.v === 1 ? record : null;
  } catch {
    return null;
  }
}

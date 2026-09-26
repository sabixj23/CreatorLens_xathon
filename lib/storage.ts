import { UNLOCK_COOKIE_NAME, type PathId } from "./types";

const CHOSEN_PATH_KEY = "creatorlens.chosen-path.v1";
const UNLOCK_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — survives a browser restart between prep and demo

// The paywall's "unlocked" state must be a cookie, not localStorage — localStorage is
// browser-only and invisible to a server route, so /api/recalibration (week 3+) and
// /api/chat could never actually enforce a localStorage-only flag. This is still an
// explicit demo boundary (no real payment), just one that works end to end: the cookie
// is readable both here, for immediate UI state, and by the API routes that enforce it.
// UNLOCK_COOKIE_NAME is exported from ./types so the frontend and the API routes that
// check it never drift apart on the cookie name.

export function isUnlocked(): boolean {
  return typeof document !== "undefined" && document.cookie.split(";").some((part) => part.trim() === `${UNLOCK_COOKIE_NAME}=1`);
}

export function unlock(): boolean {
  if (typeof document === "undefined") return false;
  document.cookie = `${UNLOCK_COOKIE_NAME}=1; Path=/; Max-Age=${UNLOCK_MAX_AGE_SECONDS}; SameSite=Lax`;
  return isUnlocked();
}

export function getChosenPath(): PathId {
  if (typeof window === "undefined") return "B";
  try {
    const value = window.localStorage.getItem(CHOSEN_PATH_KEY);
    return value === "A" || value === "B" || value === "C" ? value : "B";
  } catch {
    return "B";
  }
}

export function setChosenPath(path: PathId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHOSEN_PATH_KEY, path);
  } catch {
    /* Selection still works in memory for this session. */
  }
}

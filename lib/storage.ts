import { UNLOCK_COOKIE_NAME, type PathId } from "./types";

const CHOSEN_PATH_KEY = "creatorlens.chosenPath.v1";
const UNLOCK_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// The paywall's "unlocked" state must be a cookie, not localStorage — localStorage is
// browser-only and invisible to a server route, so /api/recalibration (week 3+) and
// /api/chat could never actually enforce a localStorage-only flag. This is still an
// explicit demo boundary (no real payment), just one that works end to end: the cookie
// is readable both here, for immediate UI state, and by the API routes that enforce it.

export function isUnlocked(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((entry) => entry === `${UNLOCK_COOKIE_NAME}=1`);
}

export function unlock() {
  if (typeof document === "undefined") return;
  document.cookie = `${UNLOCK_COOKIE_NAME}=1; path=/; max-age=${UNLOCK_MAX_AGE_SECONDS}; samesite=lax`;
}

// Nothing server-side needs the chosen path, so this one stays plain localStorage.
export function getChosenPath(): PathId | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CHOSEN_PATH_KEY);
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export function setChosenPath(pathId: PathId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHOSEN_PATH_KEY, pathId);
}

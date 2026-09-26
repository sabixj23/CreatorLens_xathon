import type { PathId } from "./types";

export const UNLOCK_COOKIE = "clx_unlocked";
const CHOSEN_PATH = "creatorlens.chosen-path.v1";

export function isUnlocked(): boolean {
  return typeof document !== "undefined" && document.cookie.split(";").some(part => part.trim() === `${UNLOCK_COOKIE}=1`);
}

export function unlock(): boolean {
  if (typeof document === "undefined") return false;
  document.cookie = `${UNLOCK_COOKIE}=1; Path=/; SameSite=Lax`;
  return isUnlocked();
}

export function getChosenPath(): PathId {
  if (typeof window === "undefined") return "B";
  try {
    const value = window.localStorage.getItem(CHOSEN_PATH);
    return value === "A" || value === "B" || value === "C" ? value : "B";
  } catch { return "B"; }
}

export function setChosenPath(path: PathId): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CHOSEN_PATH, path); } catch { /* Selection still works in memory. */ }
}

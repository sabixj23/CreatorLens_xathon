import type { Performance, SavedReview } from "./types";

const REVIEWS = "creatorlens.reviews.v1";
const PERFORMANCE = "creatorlens.performance.v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export const getReviews = () => read<SavedReview>(REVIEWS);
export const getPerformance = () => read<Performance>(PERFORMANCE);

export function saveReview(review: SavedReview) {
  localStorage.setItem(REVIEWS, JSON.stringify([review, ...getReviews()]));
}

export function deleteReview(id: string) {
  localStorage.setItem(REVIEWS, JSON.stringify(getReviews().filter((item) => item.id !== id)));
  localStorage.setItem(PERFORMANCE, JSON.stringify(getPerformance().filter((item) => item.videoId !== id)));
}

export function savePerformance(performance: Performance) {
  localStorage.setItem(PERFORMANCE, JSON.stringify([performance, ...getPerformance()]));
}

export function deletePerformance(id: string) {
  localStorage.setItem(PERFORMANCE, JSON.stringify(getPerformance().filter((item) => item.id !== id)));
}

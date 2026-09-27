// Small, dependency-free statistics used across the deterministic analysis.

export const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
export const mean = (values: number[]) => (values.length ? sum(values) / values.length : 0);

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median absolute deviation — a robust "normal week-to-week swing" that one viral week
// can't inflate the way a standard deviation would.
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

// Ratio that refuses to divide by zero or a non-positive denominator.
export function safeRatio(numerator: number, denominator: number, scale = 1): number | null {
  return denominator > 0 ? (numerator / denominator) * scale : null;
}

// Percentage change, suppressed when the earlier value is near zero (a +400% change
// from 2 to 10 subscribers is noise, not a finding) — callers show the absolute
// difference instead.
export function changePct(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  if (Math.abs(before) < 1e-9 || Math.abs(before) < 0.05 * Math.abs(after)) return null;
  return ((after - before) / Math.abs(before)) * 100;
}

export const round = (value: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

import type { ChangePoint } from "../types";
import { mad, median } from "./stats";
import type { Week } from "./weeks";
import { netSubs } from "./weeks";

const SIDE = 4; // weeks each side of a candidate split
const LOOKBACK = 24; // only look for a change in the most recent 24 weeks

// Earliest sustained drop in the recent 24 weeks. A split counts only if:
// - the 4-week median after is lower than the 4-week median before by more than twice
//   the historical median absolute deviation (MAD) up to that point, AND by at least 15%
//   (so a very smooth series can't turn a trivial dip into a "change"), and
// - at least 3 of the 4 weeks after sit below the old median.
// Returns null when the series is noisy, flat, or too short. The date is approximate.
function detect(values: number[], starts: string[], metric: ChangePoint["metric"]): ChangePoint | null {
  const first = Math.max(SIDE, values.length - LOOKBACK);
  for (let i = first; i + SIDE <= values.length; i++) {
    const beforeWin = values.slice(i - SIDE, i);
    const afterWin = values.slice(i, i + SIDE);
    const beforeMedian = median(beforeWin);
    const afterMedian = median(afterWin);
    const history = values.slice(0, i);
    const spread = mad(history);
    const threshold = spread > 0 ? 2 * spread : 0.2 * Math.abs(beforeMedian);
    if (threshold <= 0) continue;
    const drop = beforeMedian - afterMedian;
    const material = drop > threshold && drop >= 0.15 * Math.abs(beforeMedian);
    const sustained = afterWin.filter((v) => v < beforeMedian).length >= 3;
    if (material && sustained) return { metric, weekStart: starts[i], beforeMedian: Math.round(beforeMedian), afterMedian: Math.round(afterMedian) };
  }
  return null;
}

export function detectChangePoints(weeks: Week[]): ChangePoint[] {
  const starts = weeks.map((w) => w.start);
  return [detect(weeks.map(netSubs), starts, "netSubs"), detect(weeks.map((w) => w.views), starts, "views")].filter(
    (c): c is ChangePoint => c !== null
  );
}

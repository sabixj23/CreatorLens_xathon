"use client";

import { useState } from "react";
import { Icon } from "./ui";

const TOTAL_WEEKS = 12;

// Arranged in a circle rather than a straight line — a closed loop the creator moves
// around, matching "Strategy is a loop" elsewhere in the app, not a line that ends.
// Position is computed as percentages of the container's own box (not fixed pixels),
// so the circle scales with its container instead of overflowing on narrow screens.
function positionOnCircle(index: number, radiusPct: number) {
  const angle = (index / TOTAL_WEEKS) * 2 * Math.PI - Math.PI / 2; // start at 12 o'clock, clockwise
  const left = 50 + radiusPct * Math.cos(angle);
  const top = 50 + radiusPct * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

// Click a week's dot — no hover required — and its action stays shown in the
// centre of the loop until another week is picked. Defaults to week 1 so there's
// never a moment with nothing shown.
export function WeeklyTimeline({ actions }: { actions: Array<{ week: number; action: string }> }) {
  const sorted = [...actions].sort((a, b) => a.week - b.week);
  const [selectedWeek, setSelectedWeek] = useState(sorted[0]?.week ?? 1);
  const selected = sorted.find(item => item.week === selectedWeek) ?? sorted[0];

  return <div className="weekly-loop" role="tablist" aria-label="12-week action loop">
    <div className="weekly-loop-ring" aria-hidden="true" />
    {sorted.map((item, i) => {
      const dotPos = positionOnCircle(i, 42);
      const labelPos = positionOnCircle(i, 50);
      return <div className="weekly-loop-item" key={item.week}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedWeek === item.week}
          aria-controls="weekly-loop-panel"
          className={`weekly-loop-dot${selectedWeek === item.week ? " is-selected" : ""}`}
          style={dotPos}
          onClick={() => setSelectedWeek(item.week)}
        >
          <span className="sr-only">Week {item.week}</span>
        </button>
        <span className="weekly-loop-label" style={labelPos} aria-hidden="true">W{item.week}</span>
      </div>;
    })}
    {selected && <div id="weekly-loop-panel" role="tabpanel" className="weekly-loop-panel">
      <Icon name="check" size={18} />
      <span className="eyebrow">WEEK {String(selected.week).padStart(2, "0")}</span>
      <p>{selected.action}</p>
    </div>}
  </div>;
}

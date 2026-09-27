"use client";

import { useState } from "react";
import { Icon } from "./ui";

// Click a week's dot — no hover required — and its action stays visible in the
// box below until another week is picked. Defaults to week 1 so there's never
// a moment with nothing shown.
export function WeeklyTimeline({ actions }: { actions: Array<{ week: number; action: string }> }) {
  const sorted = [...actions].sort((a, b) => a.week - b.week);
  const [selectedWeek, setSelectedWeek] = useState(sorted[0]?.week ?? 1);
  const selected = sorted.find(item => item.week === selectedWeek) ?? sorted[0];

  return <div className="weekly-timeline-wrap">
    <div className="weekly-timeline" role="tablist" aria-label="12-week action timeline">
      <div className="weekly-timeline-track" aria-hidden="true" />
      {sorted.map(item => (
        <div className="weekly-timeline-item" key={item.week}>
          <button
            type="button"
            role="tab"
            aria-selected={selectedWeek === item.week}
            aria-controls="weekly-timeline-panel"
            className={`weekly-timeline-dot${selectedWeek === item.week ? " is-selected" : ""}`}
            onClick={() => setSelectedWeek(item.week)}
          >
            <span className="sr-only">Week {item.week}</span>
          </button>
          <span className="weekly-timeline-label" aria-hidden="true">W{item.week}</span>
        </div>
      ))}
    </div>
    {selected && <div id="weekly-timeline-panel" role="tabpanel" className="weekly-timeline-panel panel">
      <Icon name="check" size={18} />
      <div><span className="eyebrow">WEEK {String(selected.week).padStart(2, "0")}</span><p>{selected.action}</p></div>
    </div>}
  </div>;
}

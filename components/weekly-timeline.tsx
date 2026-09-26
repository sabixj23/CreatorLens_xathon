"use client";

import { useState } from "react";

// Dots along a 12-week line, not a card grid — hover or focus a dot to see that
// week's action. Keyboard-accessible: a focused dot shows its tooltip the same as hover.
export function WeeklyTimeline({ actions }: { actions: Array<{ week: number; action: string }> }) {
  const sorted = [...actions].sort((a, b) => a.week - b.week);
  const [active, setActive] = useState<number | null>(null);

  return <div className="weekly-timeline" role="list" aria-label="12-week action timeline — hover or focus a week for its action">
    <div className="weekly-timeline-track" aria-hidden="true" />
    {sorted.map(item => (
      <div className={`weekly-timeline-item${active === item.week ? " is-active" : ""}`} role="listitem" key={item.week}>
        <button
          type="button"
          className="weekly-timeline-dot"
          aria-describedby={`week-tip-${item.week}`}
          onMouseEnter={() => setActive(item.week)}
          onMouseLeave={() => setActive(current => (current === item.week ? null : current))}
          onFocus={() => setActive(item.week)}
          onBlur={() => setActive(current => (current === item.week ? null : current))}
        >
          <span className="sr-only">Week {item.week}</span>
        </button>
        <span className="weekly-timeline-label" aria-hidden="true">W{item.week}</span>
        <div role="tooltip" id={`week-tip-${item.week}`} className="weekly-timeline-tooltip">
          <strong>Week {item.week}</strong>
          <p>{item.action}</p>
        </div>
      </div>
    ))}
  </div>;
}

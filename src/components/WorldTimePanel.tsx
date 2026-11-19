import type { WorldTime } from "../types";
import { timeIconFor, timeTone, type TimeIcon } from "../worldTime";

function TimeGlyph({ icon }: { icon: TimeIcon }) {
  if (icon === "dawn") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8v2.2" />
        <path d="m7.4 10.2 1.4 1.4" />
        <path d="m16.6 10.2-1.4 1.4" />
        <path d="M4 17.5h16" />
        <path d="M8 17.5a4 4 0 0 0 8 0" />
      </svg>
    );
  }
  if (icon === "morning") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.1" />
        <path d="M12 4.2v2" />
        <path d="M12 17.8v2" />
        <path d="M4.2 12h2" />
        <path d="M17.8 12h2" />
        <path d="m6.3 6.3 1.4 1.4" />
        <path d="m16.3 16.3 1.4 1.4" />
        <path d="m17.7 6.3-1.4 1.4" />
        <path d="m7.7 16.3-1.4 1.4" />
      </svg>
    );
  }
  if (icon === "midday") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8.2" r="3" />
        <path d="M12 2v1.8" />
        <path d="m6.4 4.5 1.3 1.4" />
        <path d="m17.6 4.5-1.3 1.4" />
        <path d="M4.4 8.2h1.8" />
        <path d="M17.8 8.2h1.8" />
        <path d="M3.5 20h17" />
      </svg>
    );
  }
  if (icon === "afternoon") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 18.5h18" />
        <circle cx="15.5" cy="14.8" r="3.1" />
        <path d="M15.5 8.2v1.7" />
        <path d="m19 10.8-1.3 1.2" />
        <path d="M20.7 14.8h-1.7" />
      </svg>
    );
  }
  if (icon === "dusk") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 11.2v1.6" />
        <path d="m8.2 13.1 1.1 1" />
        <path d="m15.8 13.1-1.1 1" />
        <path d="M4 17.2h16" />
        <path d="M9.2 17.2a2.8 2.8 0 0 0 5.6 0" />
      </svg>
    );
  }
  if (icon === "evening") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 4.2a5.6 5.6 0 0 0 8.2 8.2 7.4 7.4 0 1 1-8.2-8.2z" />
      </svg>
    );
  }
  if (icon === "night") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 5.2a4.8 4.8 0 0 0 7 7A6.6 6.6 0 1 1 13 5.2z" />
        <path className="time-fill" d="m17.6 4.3.45 1.15 1.25.12-.95.82.28 1.22-1.03-.62-1.03.62.28-1.22-.95-.82 1.25-.12z" />
      </svg>
    );
  }
  if (icon === "late-night") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11.2 8.4a4 4 0 0 0 5.8 5.8 5.5 5.5 0 1 1-5.8-5.8z" />
        <path className="time-fill" d="m16.7 3.6.38.95 1.05.1-.8.68.24 1.02-.87-.52-.87.52.24-1.02-.8-.68 1.05-.1z" />
        <path className="time-fill" d="m19.3 8.2.32.8.88.08-.67.58.2.86-.73-.44-.73.44.2-.86-.67-.58.88-.08z" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 12V7.6" />
      <path d="M12 12l2.8 2.1" />
    </svg>
  );
}

export function WorldTimePanel({ worldTime }: { worldTime: WorldTime }) {
  const icon = timeIconFor(worldTime.time);
  const tone = timeTone(icon);
  const detail = worldTime.detail?.trim() ? worldTime.detail : "";
  const dayLabel = worldTime.dayLabel.trim() ? worldTime.dayLabel : "";
  return (
    <div className={`world-time ${tone}`}>
      <div className="world-time-icon" aria-hidden="true">
        <TimeGlyph icon={icon} />
      </div>
      <div className="world-time-copy">
        <div className="world-time-kicker">World time</div>
        <div className="world-time-row">
          <div className="world-time-clock">{worldTime.time}</div>
          <div className="world-time-day">Day {worldTime.day}</div>
        </div>
        {dayLabel ? <div className="world-time-label">{dayLabel}</div> : null}
        {detail ? <div className="world-time-detail">{detail}</div> : null}
      </div>
    </div>
  );
}

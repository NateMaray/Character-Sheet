import type { Identity, Vital } from "../types";

const TONE: Record<Vital["tone"], string> = {
  health: "var(--health)",
  mana: "var(--mana)",
  stamina: "var(--stamina)",
};

export function Hud({
  identity,
  vitals,
  coins,
  location,
  next,
  rev,
  syncedAt,
  refreshing,
  flash,
  connected,
  fallback,
  pulsing,
  onRefresh,
}: {
  identity: Identity;
  vitals: Vital[];
  coins: string;
  location: string;
  next: string;
  rev: string;
  syncedAt: Date | null;
  refreshing: boolean;
  flash: string;
  connected: boolean;
  fallback: boolean;
  pulsing: string[];
  onRefresh: () => void;
}) {
  const synced = syncedAt
    ? `Synced ${syncedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · rev ${rev}`
    : `rev ${rev}`;
  return (
    <>
      <section className="card hud">
        <div className="hud-top">
          <div>
            <div className="kicker">{identity.kicker}</div>
            <h1 className="name">{identity.name}</h1>
            <div className="sub">
              {identity.rank} · {identity.essenceLine} · {identity.asOf}
            </div>
          </div>
          <div className="hud-side">
            <div className="orbs" aria-label="Essence slots">
              {identity.slots.map((slot, index) => (
                <div key={index} className={slot.filled ? "orb filled" : "orb"} title={slot.title}>
                  {slot.filled ? slot.mark : ""}
                </div>
              ))}
            </div>
            <button type="button" className="btn primary refresh" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : flash || "Refresh"}
            </button>
          </div>
        </div>
        <div className="sync">
          <span
            className={connected ? "live-dot on" : "live-dot"}
            role="status"
            aria-label={connected ? "Live" : fallback ? "Backup file" : "Offline"}
            title={connected ? "Live" : fallback ? "Backup file" : "Offline"}
          />
          {synced}
        </div>
      </section>
      <section className="card vitals">
        {vitals.map((vital) => (
          <div key={vital.label}>
            <div className="vital-row">
              <span className="vital-label">{vital.label}</span>
              <span className={pulsing.includes(vital.label) ? "vital-pct pulse" : "vital-pct"}>
                {vital.pct}%{vital.note ? <span className="vital-note">{"  " + vital.note}</span> : null}
              </span>
            </div>
            <div className="track" aria-hidden="true">
              <span
                className={pulsing.includes(vital.label) ? "pulse" : undefined}
                style={{ width: `${Math.max(0, Math.min(100, vital.pct))}%`, ["--bar" as string]: TONE[vital.tone] || "var(--accent)" }}
              />
            </div>
          </div>
        ))}
        <div className="facts">
          <div className="fact gold">
            <b>COINS</b>
            <span>{coins}</span>
          </div>
          <div className="fact">
            <b>LOCATION</b>
            <span>{location}</span>
          </div>
          <div className="fact">
            <b>NEXT</b>
            <span>{next}</span>
          </div>
        </div>
      </section>
    </>
  );
}

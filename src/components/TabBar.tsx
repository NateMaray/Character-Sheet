import { useEffect, useRef, useState } from "react";
import { MAX_PINS, TABS, type TabId } from "../gear";

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 3h8l.8 6.2 3.2 2.1V13h-5.2L14 21h-2.2L11 13H6v-1.7l3.2-2.1L8 3z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TabBar({
  tab,
  pins,
  onSelect,
  onTogglePin,
}: {
  tab: TabId;
  pins: TabId[];
  onSelect: (tab: TabId) => void;
  onTogglePin: (tab: TabId) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pinned = pins.indexOf(tab) >= 0;
  const current = TABS.find((item) => item.value === tab) || TABS[0];
  const moreLabel = pinned ? "More" : current.label;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="tabbar">
      {open ? <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <div className="tabrow">
        <div className="pins" role="tablist" aria-label="Pinned sheets">
          {pins.map((value) => {
            const meta = TABS.find((item) => item.value === value);
            if (!meta) return null;
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                title={meta.label}
                className="tab"
                onClick={() => {
                  onSelect(value);
                  setOpen(false);
                }}
              >
                {meta.short}
              </button>
            );
          })}
        </div>
        <div className="morewrap" ref={wrap}>
          <button
            type="button"
            className={pinned ? "more" : "more is-current"}
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((value) => !value)}
          >
            {moreLabel}
            <span className="chev" />
          </button>
          {open ? (
            <div className="menu" role="menu">
              {TABS.map((item) => {
                const isPinned = pins.indexOf(item.value) >= 0;
                const active = tab === item.value;
                const canPin = isPinned || pins.length < MAX_PINS;
                return (
                  <div key={item.value} className={active ? "menu-row is-active" : "menu-row"}>
                    <button
                      type="button"
                      className="menu-go"
                      role="menuitem"
                      onClick={() => {
                        onSelect(item.value);
                        setOpen(false);
                      }}
                    >
                      {active ? <strong>{item.label}</strong> : item.label}
                    </button>
                    <button
                      type="button"
                      className="pin"
                      aria-pressed={isPinned}
                      disabled={!canPin && !isPinned}
                      title={isPinned ? `Unpin ${item.label}` : canPin ? `Pin ${item.label}` : `Unpin a tab first (max ${MAX_PINS})`}
                      onClick={() => onTogglePin(item.value)}
                    >
                      <PinIcon filled={isPinned} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

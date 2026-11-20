import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GearSource, WardrobeSlot } from "../types";
import { readOutfits, readWardrobe, WARDROBE_SLOTS, wardrobeGroups, type WardrobeFilter } from "../wardrobe";
import { Button, Pill } from "./Bits";

const FILTERS: { value: WardrobeFilter; label: string }[] = [
  { value: "All", label: "All" },
  ...WARDROBE_SLOTS.map((slot) => ({ value: slot, label: slot })),
];

export function WardrobeView({ source, onClose }: { source: GearSource; onClose: () => void }) {
  const [filter, setFilter] = useState<WardrobeFilter>("All");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const items = readWardrobe(source);
  const outfits = readOutfits(source);
  const groups = wardrobeGroups(items, filter);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="card sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wardrobe-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-head">
          <div className="title" id="wardrobe-title">
            Wardrobe
          </div>
          <Button label="Close" onClick={onClose} />
        </div>
        <div className="wardrobe-banner">
          <Pill text="DOES NOT USE INVENTORY SLOTS" on />
          <p className="body">Clothes stored here stay out of pocket space. They are not part of the slot count.</p>
        </div>
        <div className="wardrobe-filters" role="group" aria-label="Wardrobe categories">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        {items.length === 0 && filter === "All" ? (
          <p className="body">No clothes stored yet.</p>
        ) : (
          groups.map((group) => <WardrobeGroup key={group.slot} slot={group.slot} items={group.items} filtered={filter !== "All"} />)
        )}
        {outfits.length > 0 ? (
          <section className="wardrobe-group" aria-label="Outfits">
            <div className="section-label">OUTFITS</div>
            {outfits.map((outfit, index) => (
              <div key={`${outfit.name}-${index}`} className="wardrobe-item">
                <div className="title">{outfit.name}</div>
                <div className="slot-note">{outfit.items.length ? outfit.items.join(" · ") : "No pieces listed."}</div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function WardrobeGroup({
  slot,
  items,
  filtered,
}: {
  slot: WardrobeSlot;
  items: { name: string; qty?: string; note?: string }[];
  filtered: boolean;
}) {
  if (!items.length && !filtered) return null;
  return (
    <section className="wardrobe-group" aria-label={slot}>
      <div className="section-label">{slot.toUpperCase()}</div>
      {items.length === 0 ? (
        <p className="body">Nothing in {slot}.</p>
      ) : (
        items.map((item, index) => (
          <div key={`${slot}-${item.name}-${index}`} className="wardrobe-item">
            <div className="slot-name">
              <span>{item.name}</span>
              {item.qty ? <span className="slot-qty">{item.qty}</span> : null}
            </div>
            {item.note ? <div className="slot-note">{item.note}</div> : null}
          </div>
        ))
      )}
    </section>
  );
}

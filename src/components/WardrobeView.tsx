import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gearChangeActions, unwearWardrobeItem, wearWardrobeItem, wornClothNames, type GearState } from "../gear";
import type { GearSource, PocketAction, WardrobeItem, WardrobeSlot } from "../types";
import { readWardrobe, WARDROBE_SLOTS, wardrobeGroups, type WardrobeFilter } from "../wardrobe";
import { Button, Pill } from "./Bits";
import { LooksPanel } from "./LooksPanel";

const FILTERS: { value: WardrobeFilter; label: string }[] = [
  { value: "All", label: "All" },
  ...WARDROBE_SLOTS.map((slot) => ({ value: slot, label: slot })),
];

export function WardrobeView({
  source,
  gear,
  actions,
  onChange,
  onClose,
}: {
  source: GearSource;
  gear: GearState;
  actions: PocketAction[];
  onChange: (next: GearState, actions?: PocketAction[]) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<WardrobeFilter>("All");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const items = readWardrobe(source);
  const groups = wardrobeGroups(items, filter);
  const worn = wornClothNames(gear.equipped);
  const equipUnsynced = actions.some((action) => !action.synced && (action.kind === "equip" || action.kind === "unequip"));

  const commit = (next: GearState | null) => {
    if (!next || next === gear) return;
    const made = gearChangeActions(gear, next);
    onChange(next, made.length ? [...actions, ...made] : undefined);
  };

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
        {equipUnsynced ? <p className="not-synced">Not synced</p> : null}
        <LooksPanel gear={gear} source={source} actions={actions} onChange={onChange} />
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
          groups.map((group) => (
            <WardrobeGroup
              key={group.slot}
              slot={group.slot}
              items={group.items}
              filtered={filter !== "All"}
              worn={worn}
              onEquip={(item) => commit(wearWardrobeItem(gear, item))}
              onUnequip={(item) => commit(unwearWardrobeItem(gear, item.name))}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

function WardrobeGroup({
  slot,
  items,
  filtered,
  worn,
  onEquip,
  onUnequip,
}: {
  slot: WardrobeSlot;
  items: WardrobeItem[];
  filtered: boolean;
  worn: Set<string>;
  onEquip: (item: WardrobeItem) => void;
  onUnequip: (item: WardrobeItem) => void;
}) {
  if (!items.length && !filtered) return null;
  return (
    <section className="wardrobe-group" aria-label={slot}>
      <div className="section-label">{slot.toUpperCase()}</div>
      {items.length === 0 ? (
        <p className="body">Nothing in {slot}.</p>
      ) : (
        items.map((item, index) => {
          const on = worn.has(item.name);
          return (
            <div key={`${slot}-${item.name}-${index}`} className="wardrobe-item">
              <div className="slot-name">
                <span>{item.name}</span>
                {item.qty ? <span className="slot-qty">{item.qty}</span> : null}
              </div>
              {on ? <span className="worn-badge">Worn</span> : null}
              {item.note ? <div className="slot-note">{item.note}</div> : null}
              <div style={{ marginTop: 8 }}>
                <Button
                  label={on ? "Unequip" : "Equip"}
                  ariaLabel={on ? `Unequip ${item.name}` : `Equip ${item.name}`}
                  onClick={() => (on ? onUnequip(item) : onEquip(item))}
                />
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
